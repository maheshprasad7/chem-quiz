// ============================================================
// CHEMISTRY QUIZ — USN → NAME MAPPING
// Add your students here: "USN": "Full Name"
// USNs are matched case-insensitively.
// ============================================================

const STUDENTS = {
  // --- PLACEHOLDER DATA — Replace with real USN-Name pairs ---
  "1MS22CS001": "Arjun Kumar",
  "1MS22CS002": "Priya Sharma",
  "1MS22CS003": "Rahul Verma",
  "1MS22CS004": "Sneha Patel",
  "1MS22CS005": "Karan Singh",
  "1MS22CS006": "Ananya Reddy",
  "1MS22CS007": "Vikram Nair",
  "1MS22CS008": "Divya Menon",
  "1MS22CS009": "Rohit Joshi",
  "1MS22CS010": "Meera Iyer",
  // --- Add more students below ---
};

// Returns student name from USN, or null if not found
function getStudentName(usn) {
  const key = usn.trim().toUpperCase();
  return STUDENTS[key] || null;
}
