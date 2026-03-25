import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'

const SUPABASE_URL = 'https://jnklgyibjsxgotilvzyb.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impua2xneWlianN4Z290aWx2enliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgzOTE5NiwiZXhwIjoyMDg5NDE1MTk2fQ.HudcnGz8EId8ep4zrUl-EF014gjybePySThjSNDErYY'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const yearLevels = ["1", "2", "3", "4"]
const sectionLetters = ["A", "B", "C", "D"]

const mockStudents = Array.from({ length: 50 }, (_, i) => {
  const student_id = `2024-${String(i + 2).padStart(5, '0')}-USA`
  const year_level = faker.helpers.arrayElement(yearLevels)
  const sectionLetter = faker.helpers.arrayElement(sectionLetters)
  const section = `BS-PHARM-${year_level}${sectionLetter}`
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const full_name = `${firstName} ${lastName}`
  const qr_code_string = `QR_${firstName.toUpperCase()}_${String(i + 1).padStart(3, '0')}`

  return {
    student_id,
    full_name,
    year_level,
    section,
    qr_code_string,
  }
})

async function seed() {
  console.log('Seeding 50 students...')

  const { data, error } = await supabase
    .from('profiles')
    .insert(mockStudents)

  if (error) {
    console.error('Seeding failed:', error.message)
    return
  }

  console.log('Done! 50 students inserted successfully.')
}

seed()