import { IS_BROWSER } from "$fresh/runtime.ts";
import { useContext, useEffect, useState } from "preact/hooks";
import { ComponentChildren, createContext } from "preact";

const PlotlyContext = createContext(null);

function PlotlyProvider(props: { children: ComponentChildren }) {
  if (!IS_BROWSER) {
    return "";
  }
  const [plotly, setPlotly] = useState();
  return (
    <>
      <script
        src="https://cdn.plot.ly/plotly-latest.min.js"
        onLoad={() => {
          setPlotly(Plotly);
        }}
      >
      </script>
      <PlotlyContext.Provider value={plotly}>
        {props.children}
      </PlotlyContext.Provider>
    </>
  );
}

function InnerComponent() {
  const value = useContext(PlotlyContext);
  if (!value) return <div>Component placeholder</div>;
  useEffect(() => {
    if (!value) {
      return;
    }
    const plotDiv = document.getElementById("plotly")!;
    plotDiv.textContent = "Loading...";
    async function helper() {
      const response = await fetch("/api/rankings", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });
      const rankings = await response.json();
      const end = new Date();
      const start = new Date();
      start.setMonth((start.getMonth() + 11) % 12);
      plotDiv.textContent = "";
      value.newPlot(
        plotDiv,
        rankings.map(({ name, day, rank }) => (
          {
            x: day,
            y: rank,
            type: "scatter",
            mode: "line",
            name,
          }
        )),
        {
          title: "Reidle Power Rankings",
          xaxis: {
            range: [start, end],
          },
          yaxis: {
            fixedrange: true,
          },
          dragmode: "pan",
          legend: {
            font: {
              size: 20, // Set your desired font size here
            },
            bgcolor: "rgba(255,255,255,0.7)",
            orientation: "v", // Vertical layout
            x: 0, // Position on the x-axis (0 is far left)
            y: 1, // Position on the y-axis (0.5 is centered vertically)
            xanchor: "left", // Anchor the legend on the left
            yanchor: "top", // Center the legend vertically
          },
          margin: {
            l: 2, // Left margin
            r: 2, // Right margin
            t: 40, // Top margin
            b: 20, // Bottom margin
          },
        },
        { displayModeBar: false },
      );
    }
    helper();
  }, [value]);
  return <div id="plotly" style={{ height: "80vh", width: "100%" }}></div>;
}

export default function Rankings() {
  return (
    <PlotlyProvider>
      <InnerComponent />
    </PlotlyProvider>
  );
}
