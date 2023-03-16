export const handler = {
  GET() {
    return new Response("", {
      status: 307,
      headers: {
        location: `/stats/daily/${new Date().toISOString().slice(0, 10)}`,
      },
    });
  },
};
