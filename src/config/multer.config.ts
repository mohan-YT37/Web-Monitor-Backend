// src/config/multer.config.ts
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

const generateRandom = (length: number) => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

export const createStorage = (folder: string) => {
  const uploadPath = join(process.cwd(), `uploads/${folder}`);

  // create folder if not exists
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  return diskStorage({
    destination: uploadPath,

    filename: (req: any, file, cb) => {
      const userId = req?.user?.id || '0';
      const epoch = Date.now();
      const random = generateRandom(16);
      const date = new Date();
      const ymd =
        date.getFullYear() +
        ('0' + (date.getMonth() + 1)).slice(-2) +
        ('0' + date.getDate()).slice(-2);
      const ext = extname(file.originalname);
      const filename = `${epoch}_${random}_${ymd}_${userId}${ext}`;

      cb(null, filename);
    },
  });
};

export const documentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'text/plain',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, Images, TXT',
      ),
      false,
    );
  }
};

export const anyFileFilter = (req, file, cb) => {
  cb(null, true);
};
