export default function ReidleTemplate({ children }: { children?: unknown }) {
  return (
    <html>
      <head>
        <title>Reidle</title>
      </head>
      <body>
        <h1>
          <a href="/">Reidle</a>
        </h1>
        <div>
          <div>
            <a href="/messages">Messages</a>
          </div>
          <div>
            <a href="/set-name">Set Name</a>
          </div>
          <div>
            <a href="/practice">Practice</a>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
