import Game from "@/islands/game.tsx";

export default function Page() {
  return (
    <html style={{ height: "100%", margin: 0, padding: 0 }}>
      <head>
        <title>Practice</title>
      </head>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          margin: 0,
          padding: 0,
        }}
      >
        <h2 style={{ textAlign: "center" }}>Practice</h2>
        <div style={{ flexGrow: 1 }}>
          <Game
            onFinish={(time, penalty, scoring) =>
              console.log(time, penalty, scoring)}
          />
        </div>
      </body>
    </html>
  );
}
