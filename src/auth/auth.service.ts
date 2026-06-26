// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { SignUpDto } from './dto/signUp.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import {
  errorResponse,
  successResponse,
} from '../common/response/response.util';
import { CatchError } from '../common/response/catch-error.util';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { MailService } from 'src/mail/mail.service';
import {
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
  ResendOtpDto,
} from './dto/otp.dto';
import { PermissionsService } from 'src/permissions/permissions.service';
import { Role } from '../roles/entities/role.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService,

    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private permissionsService: PermissionsService,
  ) {}

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async refreshToken(rf_Token: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(rf_Token?.refresh_token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.userRepo.findOne({
        where: { id: payload?.id },
      });
      if (!user || !user.refresh_token) {
        return errorResponse('Access Denied', 401);
      }

      const isRefreshTokenValid = await bcrypt.compare(
        rf_Token.refresh_token,
        user.refresh_token,
      );
      if (!isRefreshTokenValid) {
        return errorResponse('Refresh Token Invalid', 401);
      }

      const accessToken = this.jwtService.sign(
        { id: user?.id, email: user?.email, role: user?.role },
        { expiresIn: '1h' },
      );

      const refreshToken = this.jwtService.sign(
        { id: user.id, email: user.email },
        { expiresIn: '2d' },
      );

      user.refresh_token = await bcrypt.hash(refreshToken, 10);
      await this.userRepo.save(user);

      return successResponse(
        {
          user: { username: user.username, email: user.email },
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        'Token refreshed successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async signup(body: SignUpDto) {
    if (!body.password) {
      return errorResponse('Password is required', 400);
    }

    const exisitingUser = await this.userRepo.findOne({
      where: { email: body?.email },
    });
    if (exisitingUser) {
      return errorResponse('Email already registered', 409);
    }

    try {
      const hashedPassword = await bcrypt.hash(body.password, 10);
      const user = this.userRepo.create({
        username: body.username,
        email: body.email.toLowerCase().trim(),
        password: hashedPassword,
      });
      await this.userRepo.save(user);
      return successResponse(
        { username: user.username, email: user.email },
        'User registered successfully',
        201,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async login(body: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: body.email } });
    if (!user) {
      return errorResponse('User Not Found', 404);
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.password);

    if (!isPasswordValid) {
      return errorResponse('Invalid Password', 400);
    }

    try {
      const accessToken = this.jwtService.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '1h' },
      );

      const refreshToken = this.jwtService.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '2d' },
      );

      const hashRefreshToken = await bcrypt.hash(refreshToken, 10);
      user.refresh_token = hashRefreshToken;
      await this.userRepo.save(user);

      const menus =
        await this.permissionsService.buildMenuTreeWithRolePermissions(
          user.role,
        );
      const allRoles = await this.roleRepo.find({ select: ['value'] });
      const roleValues = allRoles.map((r) => r.value);

      return successResponse(
        {
          user: {
            id: user?.id,
            username: user?.username,
            email: user?.email,
            role: user?.role,
          },
          roles: roleValues,
          menus,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        'Login successful',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({
      where: { email: body.email },
    });

    if (!user) {
      return errorResponse('User Not Found', 404);
    }

    try {
      const otp = this.generateOtp();

      user.otp = await bcrypt.hash(otp, 10);
      user.otp_verified = false;

      const expiryMinutes = 1;

      user.otp_expire_at = new Date(Date.now() + expiryMinutes * 60 * 1000);

      await this.userRepo.save(user);

      await this.mailService.sendOtpEmail(
        user.email,
        otp,
        user.username,
        'password reset',
        expiryMinutes,
      );

      return successResponse({ otp: otp }, 'OTP sent successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async resendOtp(body: ResendOtpDto) {
    return this.forgotPassword(body);
  }

  async verifyOtp(body: VerifyOtpDto) {
    const user = await this.userRepo.findOne({
      where: { email: body.email },
    });

    if (!user) {
      return errorResponse('User Not Found', 404);
    }

    if (!user.otp || !user.otp_expire_at) {
      return errorResponse('No OTP request found', 400);
    }

    if (new Date() > new Date(user.otp_expire_at)) {
      return errorResponse('OTP has expired', 400);
    }

    try {
      const isOtpValid = await bcrypt.compare(body.code, user.otp);

      if (!isOtpValid) {
        return errorResponse('Invalid OTP', 400);
      }

      user.otp_verified = true;

      user.otp = null;
      user.otp_expire_at = null;

      await this.userRepo.save(user);

      return successResponse(null, 'OTP verified successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async resetPassword(body: ResetPasswordDto) {
    const user = await this.userRepo.findOne({
      where: { email: body.email },
    });

    if (!user) {
      return errorResponse('User Not Found', 404);
    }

    if (!user.otp_verified) {
      return errorResponse('OTP verification required', 400);
    }

    try {
      user.password = await bcrypt.hash(body.newPassword, 10);

      user.otp = null;
      user.otp_expire_at = null;
      user.otp_verified = false;

      await this.userRepo.save(user);

      return successResponse(null, 'Password reset successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async logout(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return errorResponse('User Not Found', 400);
    }

    try {
      user.refresh_token = '';
      await this.userRepo.save(user);
      return successResponse([], 'Logged out successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }
}
