import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
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

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between resends

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

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
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt,
    });

    await this.userRepository.save(user);

    // Send verification email (best-effort)
    await this.emailService.sendVerificationCode(email, code, name);

    return {
      message: 'Registro exitoso. Revisa tu email para el código de verificación.',
      email: user.email,
      requiresVerification: true,
    };
  }

  async verifyEmail(verifyDto: VerifyEmailDto) {
    const { email, code } = verifyDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('Email no encontrado');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email ya verificado');
    }

    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException('No hay código de verificación pendiente');
    }

    if (new Date() > user.verificationCodeExpiresAt) {
      throw new BadRequestException('Código expirado. Solicita uno nuevo.');
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException('Código incorrecto');
    }

    // Mark verified, clear code
    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    await this.userRepository.save(user);

    // Issue JWT on successful verification
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Email verificado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
    };
  }

  async resendVerification(resendDto: ResendVerificationDto) {
    const { email } = resendDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't leak user existence — return success anyway
      return { message: 'Si el email existe, se envió un nuevo código.' };
    }

    if (user.emailVerified) {
      return { message: 'Email ya verificado.' };
    }

    // Cooldown: prevent spam
    if (
      user.verificationCodeExpiresAt &&
      user.verificationCodeExpiresAt.getTime() - VERIFICATION_CODE_TTL_MS + RESEND_COOLDOWN_MS > Date.now()
    ) {
      throw new BadRequestException('Espera al menos 1 minuto antes de solicitar otro código.');
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    user.verificationCode = code;
    user.verificationCodeExpiresAt = expiresAt;
    await this.userRepository.save(user);

    await this.emailService.sendVerificationCode(email, code, user.name);

    return { message: 'Si el email existe, se envió un nuevo código.' };
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

  private generateCode(): string {
    // Cryptographically secure 6-digit code
    return crypto.randomInt(100000, 999999).toString();
  }
}
