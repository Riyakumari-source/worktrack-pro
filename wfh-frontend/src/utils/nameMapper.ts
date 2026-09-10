// src/utils/nameMapper.ts
// Simple deterministic mapping from any string to a curated Indian name list

const indianNames = [
  "Aarav Patel",
  "Riya Sharma",
  "Kavya Singh",
  "Vihaan Mehta",
  "Ananya Gupta",
  "Arjun Kumar",
  "Priya Joshi",
  "Nikhil Rao",
  "Maya Desai",
  "Siddharth Nair",
  "Neha Bhatia",
  "Rohan Kapoor",
  "Isha Iyer",
  "Dhruv Chatterjee",
  "Swara Mishra",
  "Karan Verma",
  "Tara Shah",
  "Manav Ghosh",
  "Deepika Reddy",
  "Aditi Sinha"
];

/**
 * Returns a deterministic Indian name for a given input string.
 * The same input will always map to the same output.
 */
export function mapName(original: string): string {
  if (!original) return "";
  // Simple hash: sum char codes
  let hash = 0;
  for (let i = 0; i < original.length; i++) {
    hash = (hash + original.charCodeAt(i)) % indianNames.length;
  }
  return indianNames[hash];
}
