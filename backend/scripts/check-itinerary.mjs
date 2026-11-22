process.loadEnvFile();
const { buildItinerary } = await import("../../frontend/src/lib/travel.server.ts");
try {
  const plan = await buildItinerary({
    place: "Panjim",
    state: "Goa",
    hours: 2,
    startTime: "09:00",
    date: new Date().toISOString().slice(0, 10),
    pace: "balanced",
    interests: ["History & heritage", "Local food"],
    returnToStart: true,
  });
  console.log(
    JSON.stringify(
      {
        title: plan.title,
        aiStatus: plan.aiStatus,
        totalMinutes: plan.totalMinutes,
        budgetMinutes: plan.budgetMinutes,
        returnMinutes: plan.returnMinutes,
        stops: plan.stops.map((s) => ({ title: s.title, time: s.time, transitMin: s.transitMin })),
      },
      null,
      2,
    ),
  );
  if (!plan.totalMinutes || plan.totalMinutes > 120) throw new Error("Invalid time budget");
} catch (error) {
  console.log(`Planner check failed: ${error.message}; ${error.cause?.code || ""}`);
  process.exitCode = 1;
}
