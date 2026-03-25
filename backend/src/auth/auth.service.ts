import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { EmailService } from '../email/email.service';

/** Verification code validity in minutes */
const CODE_TTL_MINUTES = 15;

/** Minimum seconds between resend requests */
const RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a 6-digit numeric verification code.
   */
  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt,
    });

    await this.userRepository.save(user);

    // Send verification email (best-effort, fire-and-forget)
    this.emailService.sendVerificationCode(email, code, name).catch((err) => {
      this.logger.error(`Failed to send verification email: ${err.message}`);
    });

    // No JWT until email is verified
    return {
      email: user.email,
      requiresVerification: true,
      message: 'Cuenta creada. Revisa tu email para el código de verificación.',
    };
  }

  /**
   * Verify email with 6-digit code.
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('Email no encontrado');
    }

    if (user.emailVerified) {
      return { message: 'Email ya verificado', emailVerified: true };
    }

    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException(
        'No hay código de verificación pendiente. Solicita uno nuevo.',
      );
    }

    if (new Date() > user.verificationCodeExpiresAt) {
      throw new BadRequestException(
        'El código ha expirado. Solicita uno nuevo.',
      );
    }

    if (user.verificationCode !== dto.code) {
      throw new BadRequestException('Código incorrecto');
    }

    // Mark as verified and clear code
    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    await this.userRepository.save(user);

    this.logger.log(`✅ Email verificado: ${user.email}`);

    // Issue JWT on successful verification
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Email verificado exitosamente',
      emailVerified: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
    };
  }

  /**
   * Resend verification code. Rate-limited to 1 per minute.
   */
  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't leak whether email exists
      return { message: 'Si el email existe, se enviará un nuevo código.' };
    }

    if (user.emailVerified) {
      return { message: 'Email ya verificado' };
    }

    // Rate limit: check if last code was sent less than RESEND_COOLDOWN_SECONDS ago
    if (user.verificationCodeExpiresAt) {
      const codeSentAt = new Date(
        user.verificationCodeExpiresAt.getTime() - CODE_TTL_MINUTES * 60 * 1000,
      );
      const secondsSinceSent = (Date.now() - codeSentAt.getTime()) / 1000;
      if (secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceSent);
        throw new BadRequestException(
          `Espera ${waitSeconds} segundos antes de solicitar otro código.`,
        );
      }
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    user.verificationCode = code;
    user.verificationCodeExpiresAt = expiresAt;
    await this.userRepository.save(user);

    this.emailService.sendVerificationCode(user.email, code, user.name).catch((err) => {
      this.logger.error(`Failed to resend verification: ${err.message}`);
    });

    return { message: 'Si el email existe, se enviará un nuevo código.' };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Email no verificado. Revisa tu bandeja de entrada o solicita un nuevo código.',
      );
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      accessToken,
    };
  }

  async validateUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }
}
