import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private issueToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = this.generateCode();
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      emailVerified: false,
      verificationCode: hashedCode,
      verificationCodeExpiresAt: expiresAt,
    });

    await this.userRepository.save(user);

    // Fire-and-forget email — don't fail register if email fails
    this.emailService
      .sendVerificationCode(email, code, name)
      .catch(() => undefined);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      message: 'Registro exitoso. Revisa tu email para verificar tu cuenta.',
    };
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      // Already verified — just return token
      return {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken: this.issueToken(user),
      };
    }

    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException('No hay código de verificación activo');
    }

    if (new Date() > user.verificationCodeExpiresAt) {
      throw new BadRequestException('El código de verificación ha expirado');
    }

    const isValid = await bcrypt.compare(code, user.verificationCode);
    if (!isValid) {
      throw new BadRequestException('Código incorrecto');
    }

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    await this.userRepository.save(user);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: this.issueToken(user),
    };
  }

  async resendVerification(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't leak existence; just return ok
      return { message: 'Si el email existe, recibirás un código.' };
    }

    if (user.emailVerified) {
      throw new BadRequestException('El email ya está verificado');
    }

    // Cooldown: 60s between resends
    if (user.verificationCodeExpiresAt) {
      const createdAt = new Date(user.verificationCodeExpiresAt.getTime() - 15 * 60 * 1000);
      const secondsSinceCreation = (Date.now() - createdAt.getTime()) / 1000;
      if (secondsSinceCreation < 60) {
        throw new BadRequestException(
          `Espera ${Math.ceil(60 - secondsSinceCreation)} segundos antes de reenviar`,
        );
      }
    }

    const code = this.generateCode();
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCode = hashedCode;
    user.verificationCodeExpiresAt = expiresAt;
    await this.userRepository.save(user);

    this.emailService
      .sendVerificationCode(email, code, user.name)
      .catch(() => undefined);

    return { message: 'Código reenviado. Revisa tu bandeja de entrada.' };
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
      throw new ForbiddenException('Verifica tu email antes de iniciar sesión');
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: this.issueToken(user),
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
