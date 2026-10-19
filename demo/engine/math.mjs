// Canvas-compatible column-vector affine matrices: [a,b,c,d,tx,ty].
export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mod = (x, n) => ((x % n) + n) % n;
export const translate = (x, y) => [1, 0, 0, 1, x, y];
export const scale = (x, y = x) => [x, 0, 0, y, 0, 0];
export function rotate(degrees) {
  const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}
export function multiply(a, b) {
  return [
    a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]
  ];
}
export const compose = (...matrices) => matrices.reduce(multiply, IDENTITY);
export const point = (m, [x,y]) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
export const around = (pivot, matrix) =>
  compose(translate(...pivot), matrix, translate(-pivot[0], -pivot[1]));
export const angleDelta = (a,b) => mod(b-a+180,360)-180;
export const lerpAngle = (a,b,t) => a+angleDelta(a,b)*t;
export function approach(a,b,amount) {
  return Math.abs(b-a)<=amount ? b : a+Math.sign(b-a)*amount;
}
export function approachAngle(a,b,amount) {
  return mod(a+clamp(angleDelta(a,b),-amount,amount),360);
}
