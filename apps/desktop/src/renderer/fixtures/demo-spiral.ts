export const SPIRAL_GALAXY_CODE = `// Clear canvas for a fresh frame
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  // --- Background: Deep space radial gradient ---
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.7);
  bgGrad.addColorStop(0, '#000000'); // Black center
  bgGrad.addColorStop(0.2, '#080318'); // Dark purple-blue
  bgGrad.addColorStop(1, '#000000'); // Fading back to black
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // --- Distant Stars (subtle background, static and deterministic) ---
  const numDistantStars = 60; // Slightly more for richness
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // Base white, no shadow for distant stars for performance
  for (let i = 0; i < numDistantStars; i++) {
    const seed = i * 1000 + 1; // Unique deterministic seed for each star
    const x = opts.random(seed) * width;
    const y = opts.random(seed + 1) * height;
    const size = opts.random(seed + 2) * 1.2 + 0.3; // Smaller, subtle stars
    const opacity = opts.random(seed + 3) * 0.4 + 0.1; // Very subtle opacity

    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1; // Reset globalAlpha
  }


  // --- Galaxy Core (bright and glowing) ---
  const coreRadius = minDim * 0.08;
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
  coreGrad.addColorStop(0, 'rgba(255, 255, 220, 1)'); // Brightest yellow-white center
  coreGrad.addColorStop(0.4, 'rgba(255, 160, 0, 0.9)'); // Orange-yellow glow
  coreGrad.addColorStop(1, 'rgba(255, 0, 120, 0)'); // Fading pinkish outer edge
  ctx.fillStyle = coreGrad;
  ctx.shadowBlur = 40; // Intense glow for the core
  ctx.shadowColor = 'rgba(255, 180, 0, 0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // Reset shadow for subsequent elements


  // --- Spiral Arms Particles ---
  const numArms = 4; // Number of distinct spiral arms
  const particlesPerArm = 35; // Number of particles in each arm
  const totalParticles = numArms * particlesPerArm; // Total 140 particles, optimized for performance
  const spiralWindingFactor = 2.5; // How many rotations an arm makes from inner to outer edge
  const minArmRadius = minDim * 0.07; // Start slightly outside the core
  const maxArmRadius = minDim * 0.4; // Outer extent of the spiral arms
  const galaxyRotationSpeed = 1; // 1 full rotation per animation cycle for seamless loop
  const particlePulseMagnitude = 4; // Amplitude of particle pulsation
  const particleBaseSize = 1.5;

  for (let k = 0; k < totalParticles; k++) {
    const armIndex = Math.floor(k / particlesPerArm);
    const particleIndexInArm = k % particlesPerArm;
    const seed = k * 100 + armIndex; // Unique deterministic seed for particle properties

    // Calculate base angle for the start of each arm
    const baseArmAngle = (armIndex / numArms) * Math.PI * 2;

    // Calculate progression along the spiral for this particle (0 to 1)
    const spiralProgress = particleIndexInArm / particlesPerArm;

    // Radius varies along the arm, from inner to outer
    const initialRadius = minArmRadius + spiralProgress * (maxArmRadius - minArmRadius);

    // Angle varies along the arm to form the spiral shape, plus a small random jitter
    const initialAngle = baseArmAngle + (spiralProgress * Math.PI * 2 * spiralWindingFactor) + (opts.random(seed + 4) - 0.5) * 0.15;

    // --- Animation Logic for Seamless Looping ---
    // Overall galaxy rotation
    const currentGalaxyRotation = t * Math.PI * 2 * galaxyRotationSpeed;

    // Particle subtle wobble/pulse for liveliness, ensuring seamless loop
    // Phase offset depends on particle's position and index for variation
    const pulsePhase = (initialRadius / maxArmRadius) * Math.PI * 2 * 3; // Waves along the arm
    const pulse = Math.sin(t * Math.PI * 2 * 2 + pulsePhase + particleIndexInArm * 0.1) * particlePulseMagnitude;

    // Final animated radius and angle
    const currentRadius = initialRadius + pulse;
    const currentAngle = initialAngle + currentGalaxyRotation;

    // Calculate particle position
    const x = cx + currentRadius * Math.cos(currentAngle);
    const y = cy + currentRadius * Math.sin(currentAngle);

    // Particle size variation, also animated for seamless loop
    const size = particleBaseSize + (opts.random(seed + 5) * 0.8 - 0.4) + Math.sin(t * Math.PI * 2 * 3 + k * 0.2) * 0.6;
    const actualSize = Math.max(0.5, size); // Ensure size is always positive

    // Dynamic color based on arm index and a subtle time-based hue shift
    const hueShift = Math.sin(t * Math.PI * 2) * 15; // Shift hue slightly back and forth
    let color;
    if (armIndex % 2 === 0) {
      color = \`hsl(\${200 + hueShift}, 100%, 70%)\`; // Blue-ish
    } else {
      color = \`hsl(\${280 + hueShift}, 100%, 70%)\`; // Purple-ish
    }

    // Draw particle with glow
    ctx.save();
    ctx.shadowBlur = 10; // Glow for individual particles
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, actualSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
`;
