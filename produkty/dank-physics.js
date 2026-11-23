export const rimX = 14.2;
export const rimY = 3.05;
export const rimRadius = .30;
export const rimTube = .022;
export const netDepth = .48;
export const netExit = .152;
export const board = { x: 14.66, bottom: 2.75, top: 3.67, depth: .46 };
export const ballR = .125;
export const handY = 1.78;
export const stepTime = 1 / 240;

const gravity = 9.81;
const direction = 55 * Math.PI / 180;
const rimEdges = [rimX - rimRadius, rimX + rimRadius];
const opening = rimRadius - rimTube - ballR;

export function createShot(distance, power) {
  const speed = 4.7 + power * 10.65;
  const vx = speed * Math.cos(direction);
  const vy = speed * Math.sin(direction);
  const x = rimX - distance;
  const discriminant = vy * vy - 2 * gravity * (rimY - handY);
  const crossing = discriminant > 0 ? x + vx * (vy + Math.sqrt(discriminant)) / gravity : x;
  return {
    x, y: handY, vx, vy, elapsed: 0, groundHits: 0,
    boardHit: false, rimHit: false, basket: false, bank: false,
    short: crossing < rimX,
  };
}

function bounce(ball, x, y, radius, restitution) {
  const dx = ball.x - x;
  const dy = ball.y - y;
  const distance = Math.hypot(dx, dy);
  const contact = radius + ballR;
  if (distance >= contact) return false;

  const nx = distance > 0 ? dx / distance : -Math.sign(ball.vx) || -1;
  const ny = distance > 0 ? dy / distance : 0;
  ball.x = x + nx * contact;
  ball.y = y + ny * contact;
  const inbound = ball.vx * nx + ball.vy * ny;
  if (inbound >= 0) return false;
  const impulse = (1 + restitution) * inbound;
  ball.vx -= impulse * nx;
  ball.vy -= impulse * ny;
  return true;
}

export function stepShot(ball) {
  const { x, y } = ball;
  ball.elapsed += stepTime;
  ball.vy -= gravity * stepTime;
  ball.x += ball.vx * stepTime;
  ball.y += ball.vy * stepTime;

  const boardY = Math.max(board.bottom, Math.min(board.top, ball.y));
  if (bounce(ball, board.x, boardY, 0, .62)) ball.boardHit = true;
  for (const edge of rimEdges) {
    if (bounce(ball, edge, rimY, rimTube, .70)) ball.rimHit = true;
  }

  if (!ball.basket && y >= rimY && ball.y < rimY && ball.vy < 0) {
    const crossing = x + (ball.x - x) * (y - rimY) / (y - ball.y);
    if (Math.abs(crossing - rimX) <= opening) {
      ball.basket = true;
      ball.bank = ball.boardHit;
      ball.netContact = { x: crossing - rimX, time: ball.elapsed };
    }
  }

  if (ball.basket && ball.y < rimY && ball.y >= rimY - netDepth - ballR) {
    const depth = Math.min(1, (rimY - ball.y) / netDepth);
    const clearance = opening + (netExit - ballR - opening) * depth;
    const offset = ball.x - rimX;
    if (Math.abs(offset) > clearance) {
      const side = Math.sign(offset);
      ball.x = rimX + side * clearance;
      if (ball.vx * side > 0) ball.vx *= -.15;
    }
    ball.vx *= .96;
    ball.vy *= .986;
  }

  if (ball.y <= ballR && ball.vy < 0) {
    ball.y = ballR;
    ball.vy *= -.32;
    ball.vx *= .74;
    ball.groundHits++;
  }
  return ball.groundHits >= 2 || ball.x < -1 || ball.x > 16.5 || ball.elapsed >= 5.5;
}
