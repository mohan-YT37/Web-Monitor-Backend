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
import { Role } from 'src/common/enum/role.enum';
import { getMenuByRole } from 'src/common/menu/menu.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async refreshToken(rf_Token: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(rf_Token?.refresh_token, {
        secret: process.env.JWT_SECRET,
      });
      // console.log('refreshToken_service',rf_Token,payload)

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
      // console.log('Register_user', user);
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
    // console.log('body', body);
    if (!user) {
      return errorResponse('User Not Found', 404);
    }

    // console.log('current_login_user', user);

    const isPasswordValid = await bcrypt.compare(body.password, user.password);

    if (!isPasswordValid) {
      return errorResponse('Invalid Password', 400);
    }
    // console.log('JWT Secret:', process.env.JWT_SECRET);
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

      const menus = getMenuByRole(user.role);

      return successResponse(
        {
          user: {
            id: user?.id,
            username: user?.username,
            email: user?.email,
            role: user?.role,
          },
          roles: Object.values(Role),
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

  async logout(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    // console.log(user,userId)
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
