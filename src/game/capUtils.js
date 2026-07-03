// R[1][1] = 1 - 2(qx² + qz²): positive means local Y points world-up = face-up
export const isFaceUp = (body) => (1 - 2 * (body.quaternion.x ** 2 + body.quaternion.z ** 2)) > 0;
