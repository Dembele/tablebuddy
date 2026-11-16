import { Request, Response, NextFunction } from 'express';
import { Session } from "@backend/models/Session";
import {IUser, UserSafe} from "@backend/deps/interfaces/DB/User"

// Common session population
async function getPopulatedSession(token: string) {
  return Session.findOne({ token })
    .populate<{ user: IUser }>('user');
}

export type AuthResult =
  | { code: 200, user: UserSafe }
  | { code: 401 | 403 | 500, message: string };

export async function identifyUser(req: Request): Promise<AuthResult> {
  try {
    const token = req.cookies?.session;

    if (!token) {
      return { code: 401, message: 'No session token' };
    }

    const session = await getPopulatedSession(token);

    if (!session) {
      return { code: 401, message: 'Сессия не найдена' };
    }

    if (session.expires < new Date()) {
      return { code: 401, message: 'Сессия истекла' };
    }

    return {
      code: 200,
      user: {
        _id: session.user._id.toString(),
        username: session.user.username,
        role: session.user.role,
        createdAt: session.user.createdAt,
      }
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { code: 500, message: 'Identification failed' };
  }
}

// Middleware for regular session validation
export async function validateSession(req: Request & {user: UserSafe | undefined}, res: Response, next: NextFunction) {
  const result = await identifyUser(req);

  if (result.code === 200) {
    req.user = result.user; // Attach user to request
    return next();
  }

  // Handle different error cases
  switch (result.code) {
    case 401:
      return res.status(401).json({ error: result.message });
    case 403:
      return res.status(403).json({ error: result.message });
    default:
      return res.status(500).json({ error: result.message });
  }
}

// Middleware for GM role validation
export async function validateGmSession(req: Request & {user: UserSafe | undefined}, res: Response, next: NextFunction) {
  const result = await identifyUser(req);

  if (result.code !== 200) {
    switch (result.code) {
      case 401:
        return res.status(401).json({ error: result.message });
      case 403:
        return res.status(403).json({ error: result.message });
      default:
        return res.status(500).json({ error: result.message });
    }
  }

  try {
    if (result.user.role !== "ГМ") {
      return res.status(403).json({ error: 'Учетная запись не является ГМ' });
    }

    req.user = result.user; // Attach user to request
    return next();
  } catch (error) {
    console.error('Admin validation error:', error);
    return res.status(500).json({ error: 'Administrative authentication failed' });
  }
}