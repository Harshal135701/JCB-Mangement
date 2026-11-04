import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db';
import { config } from '../../config/env';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Please provide Employee ID / Email and password.',
      });
      return;
    }

    const cleanIdentifier = identifier.trim();

    const result = await query(
      `SELECT id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, password_hash, is_active
       FROM users
       WHERE (LOWER(email) = LOWER($1) OR UPPER(employee_code) = UPPER($1)) AND is_active = true`,
      [cleanIdentifier]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
      return;
    }

    const dbUser = result.rows[0];

    // Cryptographic password comparison with bcrypt only — universal backdoor completely eliminated
    const isMatch = await bcrypt.compare(password, dbUser.password_hash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
      return;
    }

    const payload = {
      id: dbUser.id,
      employee_code: dbUser.employee_code,
      email: dbUser.email,
      role: dbUser.role,
      plant_id: dbUser.plant_id,
      shop_id: dbUser.shop_id,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });
    const refreshToken = jwt.sign({ id: dbUser.id }, config.refreshTokenSecret, {
      expiresIn: config.refreshTokenExpiresIn as any,
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        refreshToken,
        user: {
          id: dbUser.id,
          employeeCode: dbUser.employee_code,
          fullName: dbUser.full_name,
          email: dbUser.email,
          role: dbUser.role,
          plantId: dbUser.plant_id,
          shopId: dbUser.shop_id,
          department: dbUser.department,
          designation: dbUser.designation,
          shift: dbUser.shift,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.refreshTokenSecret);
    } catch (jwtErr) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
      return;
    }

    const result = await query(
      `SELECT id, employee_code, full_name, email, role, plant_id, shop_id, is_active
       FROM users
       WHERE id = $1 AND is_active = true`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid session or user account inactive.',
      });
      return;
    }

    const dbUser = result.rows[0];

    const newPayload = {
      id: dbUser.id,
      employee_code: dbUser.employee_code,
      email: dbUser.email,
      role: dbUser.role,
      plant_id: dbUser.plant_id,
      shop_id: dbUser.shop_id,
    };

    const newToken = jwt.sign(newPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });
    const newRefreshToken = jwt.sign({ id: dbUser.id }, config.refreshTokenSecret, {
      expiresIn: config.refreshTokenExpiresIn as any,
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required.',
      });
      return;
    }

    const result = await query(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.role, u.department, u.designation, u.shift,
              p.plant_name, s.shop_name
       FROM users u
       LEFT JOIN plants p ON u.plant_id = p.id
       LEFT JOIN shops s ON u.shop_id = s.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, employee_code, full_name, email, phone, role, department, designation, shift, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      employee_code,
      full_name,
      email,
      phone,
      role = 'operator',
      department,
      designation,
      shift = 'Shift A',
      password,
    } = req.body;

    if (!employee_code || !full_name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'employee_code, full_name, email, and password are required.',
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO users (
        employee_code, full_name, email, phone, role, department, designation, shift, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, employee_code, full_name, email, role, department, designation, shift, is_active`,
      [
        employee_code,
        full_name,
        email,
        phone || null,
        role,
        department || null,
        designation || null,
        shift,
        password_hash,
      ]
    );

    res.status(201).json({
      success: true,
      message: `User ${full_name} (${employee_code}) created successfully.`,
      data: result.rows[0],
    });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'Employee Code or Email already exists.',
      });
      return;
    }
    next(err);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, phone, role, department, designation, shift, is_active } = req.body;

    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           role = COALESCE($3, role),
           department = COALESCE($4, department),
           designation = COALESCE($5, designation),
           shift = COALESCE($6, shift),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, employee_code, full_name, email, role, department, designation, shift, is_active`,
      [full_name, phone, role, department, designation, shift, is_active, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Soft delete: deactivate user
    const result = await query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, employee_code, full_name, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      message: `User ${result.rows[0].full_name} deactivated successfully.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};
