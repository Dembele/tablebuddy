import { Response, NextFunction } from 'express';
import { Session } from "@backend/models/Session";
import { IUser } from "@backend/deps/interfaces/DB/User";
import { Request } from "@backend/types/Request";

export function defaultPermission(roleRequired: 'ГМ' | 'Игрок' = 'ГМ') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.token) {
      res.status(401).send('Токен авторизация отсутствует');
      return;
    }

    let session;
    try {
      session = await Session.findOne({ token: req.token }).populate<{ user: {_id: IUser['_id'], role: IUser['role']} }>('user', 'role');
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).send('Ошибка сервера');
      return;
    }

    if (!session) {
      res.status(404).send('Сессия не найдена');
      return;
    }

    const user = session.user;
    req.user = user;

    if (roleRequired === 'ГМ' && user.role !== 'ГМ') {
      res.status(403).send('Недостаточно прав');
      return;
    }

    next();
  };
}