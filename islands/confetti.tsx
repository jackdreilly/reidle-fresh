import { useEffect, useState } from "preact/hooks";
const stepMS = 1;
const nConfetti = 200;
class State {
  step(): State {
    for (const confetti of this.confetti) {
      confetti.stepForward();
    }
    return this.copy();
  }
  copy(): State {
    return new State(this.confetti, this.n);
  }
  constructor(public confetti: ConfettiPiece[], public n: number) {}
  static make(n: number): State {
    return new State(repeat(nConfetti, () => ConfettiPiece.randomStart()), n);
  }
}
type VectorLike = Vector | number | [number, number, number];
function rand(): number {
  return (Math.random() - 0.5) * 2;
}
class Vector {
  mod(v: number): Vector {
    return new Vector(this.x % v, this.y % v, this.z % v);
  }
  rotateXY(degrees: number) {
    const radians = (degrees * Math.PI) / 180;
    const [x, y] = [this.x, this.y];
    return new Vector(
      x * Math.cos(radians) - y * Math.sin(radians),
      x * Math.sin(radians) + y * Math.cos(radians),
      this.z,
    );
  }
  constructor(public x: number, public y: number, public z: number) {}
  add(v: VectorLike) {
    if (typeof v === "number") {
      return new Vector(this.x + v, this.y + v, this.z + v);
    }
    if (Array.isArray(v)) {
      return new Vector(this.x + v[0], this.y + v[1], this.z + v[2]);
    }
    return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v: VectorLike) {
    if (typeof v === "number") {
      return new Vector(this.x - v, this.y - v, this.z - v);
    }
    if (Array.isArray(v)) {
      return new Vector(this.x - v[0], this.y - v[1], this.z - v[2]);
    }
    return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  mul(s: number) {
    return new Vector(this.x * s, this.y * s, this.z * s);
  }
  div(s: number) {
    return new Vector(this.x / s, this.y / s, this.z / s);
  }
  mag() {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }
  norm() {
    return this.div(this.mag());
  }
  cross(v: Vector) {
    return new Vector(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }
  dot(v: Vector) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  static random(): Vector {
    return new Vector(rand(), rand(), rand());
  }
}
class Hsl {
  constructor(public h: number, public s: number, public l: number) {}
}
class ConfettiPiece {
  constructor(
    public position: Vector,
    public velocity: Vector,
    public rotation: Vector,
    public rotationVelocity: Vector,
    public hsl: Hsl,
    public minVelocity: number,
  ) {}
  stepForward() {
    this.position = this.position.add(this.velocity);
    this.rotation = this.rotation.add(this.rotationVelocity);
    this.velocity.y = Math.max(
      this.minVelocity,
      this.velocity.y - 20e-5 - Math.abs(this.velocity.y) * .8e-1,
    );
    this.velocity.x += rand() * 5e-5;
    this.velocity.x *= .99;
    this.rotationVelocity = this.rotationVelocity.mul(.99999);
  }
  static randomStart() {
    const rotationVelocity = Vector.random().add(1).norm().mul(1e-1);
    const rotation = Vector.random().norm().mul(1e3);
    rotation.x *= 6e-2;
    const velocity = new Vector(0, 1, 0).add(Vector.random().mul(1e-2))
      .rotateXY(
        rand() * 3,
      ).norm().mul((1 + rand() * 1e-1) * 7.5e-2);
    const hsl = new Hsl(Math.random() * 360, 50, 50);
    const position = new Vector(0.5 + rand() * 1e-3, 0, 1 + rand() * 3e-1);
    return new ConfettiPiece(
      position,
      velocity,
      rotation,
      rotationVelocity,
      hsl,
      -3e-3 * (1 + rand() * 0.4),
    );
  }
  svg() {
    const { position, rotation, hsl } = this;
    const [x, y, z] = [position.x, position.y, position.z];
    const [rx, ry, rz] = [rotation.x, rotation.y, rotation.z];
    return (
      <g
        transform={`
        translate(${x}, ${y})
        scale(${z})
      `}
      >
        <g
          transform={`rotate(${rx} ${
            (Math.abs(Math.cos(ry * 1e-0)) * 8e-3 + 1e-3) * 0.5
          } 4e-2)`}
        >
          <rect
            width={Math.abs(Math.cos(ry * 1e-0)) * 8e-3 + 1e-3}
            height={8e-2}
            x="0"
            y="0"
            fill={`hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`}
          />
        </g>
      </g>
    );
  }
}
export default function Confetti() {
  const [{ confetti }, setState] = useState<State>(() => State.make(100));
  useEffect(() => {
    const interval = setInterval(() => {
      setState((state) => state.step());
    }, stepMS);
    return () => clearInterval(interval);
  }, []);
  return (
    <svg height="150%" width="150%" viewBox="0 0 1 1">
      <g transform={`translate(0, 1) scale(1,-1)`}>
        {confetti.map((c, i) => c.svg())}
      </g>
    </svg>
  );
}

function repeat<T>(n: number, fn: (i: number) => T): T[] {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(fn(i));
  }
  return result;
}
