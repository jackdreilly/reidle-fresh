export const handler = {
  GET() {
    return new Response("redirect to today", {
      status: 307,
      headers: { location: "/stats/today" },
    });
  },
};
