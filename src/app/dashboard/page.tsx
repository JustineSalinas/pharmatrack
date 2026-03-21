import { supabase } from "../../lib/supabase";

export default async function TestPage() {
  // Fetch the students you just seeded
  const { data: students, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">PharmaTrack Connection Test</h1>
      
      {error && <p className="text-red-500">Error: {error.message}</p>}
      
      {!error && students && (
        <ul className="space-y-2">
          {students.map((student) => (
            <li key={student.id} className="p-3 bg-purple-50 rounded border border-purple-200">
              <span className="font-bold">{student.full_name}</span> - {student.student_id}
            </li>
          ))}
        </ul>
      )}
      
      <p className="mt-4 text-sm text-gray-500">
        If you see names above, the Database is officially connected!
      </p>
    </div>
  );
}