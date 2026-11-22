export function validateAge(raw: string, category: string): string | null {
  if (!raw.trim())
    return "Enter an age so the selected category can be checked.";
  const age = Number(raw);
  if (
    !/^\d+$/.test(raw.trim()) ||
    !Number.isInteger(age) ||
    age < 0 ||
    age > 120
  )
    return "Age must be a whole number from 0 to 120.";
  if (category === "kid" && age >= 18)
    return "Child tags are for ages 0–17. Choose Adult or Senior for this age.";
  if (
    (category === "adult" || category === "member") &&
    (age < 18 || age >= 60)
  )
    return "Adult tags are for ages 18–59. Choose Child or Senior for this age.";
  if (category === "senior" && age < 60)
    return "Senior tags are for ages 60–120. Choose the matching category.";
  if (!["kid", "adult", "member", "senior"].includes(category))
    return "Choose a valid age category.";
  return null;
}
