import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const yearLevels = ["1", "2", "3", "4"]
const sectionLetters = ["A", "B", "C", "D"]

async function seed() {
  console.log('Seeding 50 students...')

  for (let i = 0; i < 50; i++) {
    const year_level = faker.helpers.arrayElement(yearLevels)
    const sectionLetter = faker.helpers.arrayElement(sectionLetters)
    const section = `BS-PHARM-${year_level}${sectionLetter}`
    const full_name = faker.person.fullName()
    const email = faker.internet.email().toLowerCase()
    const student_id_number = `2024-${String(i + 2).padStart(5, '0')}-USA`
    const qr_code_id = `QR-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'Password1234!',
      email_confirm: true,
      user_metadata: { full_name, account_type: 'student' },
    })
    if (authError) {
      console.error(`[${i + 1}] Auth error:`, authError.message)
      continue
    }

    const userId = authData.user.id

    // 2. Insert into users table
    const { error: userErr } = await supabase.from('users').insert({
      id: userId,
      email,
      full_name,
      account_type: 'student',
      status: 'approved',
    })
    if (userErr) {
      console.error(`[${i + 1}] User insert error:`, userErr.message)
      await supabase.auth.admin.deleteUser(userId)
      continue
    }

    // 3. Insert into student_profiles table
    const { error: profileErr } = await supabase.from('student_profiles').insert({
      user_id: userId,
      student_id_number,
      section,
      current_year: year_level,
      qr_code_id,
    })
    if (profileErr) {
      console.error(`[${i + 1}] Profile insert error:`, profileErr.message)
      await supabase.auth.admin.deleteUser(userId)
      continue
    }

    console.log(`[${i + 1}] Seeded: ${full_name} (${email})`)
  }

  console.log('Done seeding!')
}

seed()
