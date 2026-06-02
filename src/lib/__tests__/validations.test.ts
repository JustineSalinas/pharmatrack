import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  studentRegisterSchema,
  facilitatorRegisterSchema,
  adminRegisterSchema,
  qrSessionSchema
} from '../validations'
import { UpdateProfileSchema } from '../schema'

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login credentials', () => {
      const validData = {
        email: 'user@example.com',
        password: 'password123'
      }
      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should fail validation with invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123'
      }
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid email address')
      }
    })

    it('should fail validation with a password too short', () => {
      const invalidData = {
        email: 'user@example.com',
        password: '12345'
      }
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must be at least 6 characters')
      }
    })
  })

  describe('studentRegisterSchema', () => {
    const validStudentData = {
      email: 'student@usa.edu.ph',
      full_name: 'John Doe',
      password: 'password123',
      confirm_password: 'password123',
      account_type: 'student' as const,
      student_id_number: 'USA-2026-0001',
      section: 'A',
      current_year: '3'
    }

    it('should validate a correct student registration data set', () => {
      const result = studentRegisterSchema.safeParse(validStudentData)
      expect(result.success).toBe(true)
    })

    it('should fail if email does not end with .edu.ph', () => {
      const data = { ...validStudentData, email: 'student@gmail.com' }
      const result = studentRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Must be a university email')
      }
    })

    it('should fail if password is too short', () => {
      const data = { ...validStudentData, password: 'short', confirm_password: 'short' }
      const result = studentRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must be at least 8 characters')
      }
    })

    it('should fail if passwords do not match', () => {
      const data = { ...validStudentData, confirm_password: 'differentpassword' }
      const result = studentRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Passwords do not match')
        expect(result.error.errors[0].path).toContain('confirm_password')
      }
    })

    it('should fail if student id number is too short', () => {
      const data = { ...validStudentData, student_id_number: '123' }
      const result = studentRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('ID is required')
      }
    })
  })

  describe('facilitatorRegisterSchema', () => {
    const validFacilitatorData = {
      email: 'teacher@usa.edu.ph',
      full_name: 'Professor Jane',
      password: 'password1234',
      confirm_password: 'password1234',
      account_type: 'facilitator' as const
    }

    it('should validate a correct facilitator registration data set', () => {
      const result = facilitatorRegisterSchema.safeParse(validFacilitatorData)
      expect(result.success).toBe(true)
    })

    it('should fail if email is not ending with .edu.ph', () => {
      const data = { ...validFacilitatorData, email: 'teacher@example.com' }
      const result = facilitatorRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Must be a university email')
      }
    })

    it('should fail if passwords do not match', () => {
      const data = { ...validFacilitatorData, confirm_password: 'differentpassword' }
      const result = facilitatorRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Passwords do not match')
      }
    })
  })

  describe('adminRegisterSchema', () => {
    const validAdminData = {
      email: '>admin@[REDACTED]',
      full_name: 'Administrator',
      password: 'adminpassword123',
      confirm_password: 'adminpassword123',
      account_type: 'admin' as const
    }

    it('should validate a correct admin registration data set', () => {
      const result = adminRegisterSchema.safeParse(validAdminData)
      expect(result.success).toBe(true)
    })

    it('should fail if account_type is not admin', () => {
      const data = { ...validAdminData, account_type: 'student' as any }
      const result = adminRegisterSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('qrSessionSchema', () => {
    const validSession = {
      subject: 'Pharmacology 101',
      section: 'Ph-3A',
      date: '2026-06-03',
      duration_minutes: 30
    }

    it('should validate correct QR session parameters', () => {
      const result = qrSessionSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })

    it('should fail if duration is less than 1 minute', () => {
      const data = { ...validSession, duration_minutes: 0 }
      const result = qrSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail if duration is greater than 60 minutes', () => {
      const data = { ...validSession, duration_minutes: 61 }
      const result = qrSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail if subject is empty', () => {
      const data = { ...validSession, subject: '' }
      const result = qrSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Subject is required')
      }
    })
  })

  describe('UpdateProfileSchema', () => {
    it('should validate correct profile inputs', () => {
      const result = UpdateProfileSchema.safeParse({ full_name: 'Alice Smith' })
      expect(result.success).toBe(true)
    })

    it('should fail if full_name is less than 2 characters', () => {
      const result = UpdateProfileSchema.safeParse({ full_name: 'A' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Full name must be at least 2 characters')
      }
    })
  })
})
