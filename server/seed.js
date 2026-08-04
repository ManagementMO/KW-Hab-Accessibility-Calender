import { hashPassword } from './auth.js'
import { createStaff, findStaffByEmail } from './staffRepo.js'

export async function seedStaff(db, email, password) {
  if (findStaffByEmail(db, email)) return { created: false, email }
  const passwordHash = await hashPassword(password)
  createStaff(db, { email, passwordHash })
  return { created: true, email }
}
