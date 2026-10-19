# Step 5 test names (test/xml-off-semantics.test.mjs and test/xml-particle-flags.test.mjs)

## Owner decisions (commit: Off = stop + reset ...)

- PARTICLE_OFF constant records the chosen semantics: stop + reset, not a latch, live particles finish
- Off sets emitter running=false and clears emitted count and delay timer
- Off: live particles finish their life after emission stops
- Off resets emitted count: a finite emitter (3 particles) emits its 3 again after Off + restart
- Off clears the delay timer: after restart nothing is born until a full new delayTimer has elapsed
- Off is not a latch: the next Update starts the system again
- Off wins over an Update for the same system on the same frame
- AddClothingParticles is continuous while worn (constant + hook liveness)
- AddClothingParticles is condition-gated every frame: onAction=PUNCH emits only while punching and restarts each punch
- AddClothingParticles content gated by StopIf is re-evaluated every frame (stops while airborne, resumes on landing)
- OnPunchBegin / OnPunchStop evidence: the ArcaneArmor Update/Off pairs exist in the shipped data and are mapped as documented
- xml-support entries touched by these decisions stay 'partial' (none promoted to full)

## Infrastructure (commit: runs carry emitter state and a position trail)

- infra: a run records the emitter position each frame and emitterPosAt returns the position at a past time

## 5.1

- 5.1 relativeToEmitter=true: the particle follows the player after spawn
- 5.1 relativeToEmitter=false: the particle stays where it spawned when the player moves (x and y)
- 5.1 relativeToEmitter=false: a particle born after the player moved is anchored at the NEW spawn position
- 5.1 relativeToEmitter absent: default is RELATIVE_TO_EMITTER_DEFAULT (follows), so existing items do not change
- 5.1 relativeToEmitter is marked partial in xml-support (default is [HYP])

## 5.2

- 5.2 rotateWithVelocity=true: velocity (0,1) rotates the sprite +90 degrees
- 5.2 rotateWithVelocity=true: velocity (1,0) is 0, (-1,0) is 180, (0,-1) is -90
- 5.2 rotateWithVelocity=true adds to initialAngle; false/absent leaves the angle alone
- 5.2 rotateWithVelocity=true with zero velocity does not rotate (no NaN)
- 5.2 rotateWithVelocity follows the instantaneous velocity when gravity bends the path

## 5.3

- 5.3 usePlayerFacing=true, facing=-1: the particle is mirrored with the player exactly once (offset x and sprite flip)
- 5.3 usePlayerFacing=false, facing=-1: the particle ignores facing (same matrix as facing=+1)
- 5.3 usePlayerFacing=false: velocity.x is not mirrored (moves the same screen direction at facing -1 and +1)
- 5.3 usePlayerFacing=true: velocity.x is mirrored with the player
- 5.3 usePlayerFacing=false composes with an authored flipX exactly once (no double flip)
- 5.3 Emitter.offsetFacing=false: the emitter offset does not mirror with facing; true does (sprite centre on screen)
- 5.3 absent flags keep the old behaviour (mirrored with the player); constants record the [HYP] defaults

## 5.4

- 5.4 renderAlignment maps every value in the data set to its anchor (ax,ay)
- 5.4 renderAlignment: every value used in the shipped XML is a known alignment
- 5.4 renderAlignment DOWN_CENTER draws the sprite above the particle point; UPPER_CENTER below it (final matrices)
- 5.4 renderAlignment LEFT_CENTER / RIGHT_CENTER shift the sprite horizontally by half its width
- 5.4 renderAlignment: absent keeps CENTER; an unknown value falls back to CENTER and is reported on the item

## 5.5

- 5.5 isBackgroundParticle=true: the particle is assigned the BEHIND pass, which is the first pass in the profile
- 5.5 isBackgroundParticle=false/absent: the particle keeps the pass of the hook that started it
- 5.5 isBackgroundParticle=true overrides a front pass (RenderInFront hook) and reaches the final draw list in the BEHIND pass
- 5.5 isBackgroundParticle is marked partial in xml-support

## 5.6a

- 5.6a interpolateAlpha=true: alpha goes linearly from initialAlpha to finalAlpha over the lifetime
- 5.6a interpolateAlpha=true can rise: initial 0.2 -> final 1
- 5.6a interpolateAlpha=false or absent: finalAlpha is ignored and alpha stays at initialAlpha
- 5.6a interpolateAlpha=true with no finalAlpha is ignored and reported, alpha unchanged
- 5.6a interpolateAlpha: the shipped data has 40+ systems using it, and both SUPPORT entries are partial

## 5.6b

- 5.6b interpolateVelocity=true: velocity goes linearly (0 -> 20) so travel = v0*a + (vF-v0)*a^2/(2*life)
- 5.6b interpolateVelocity=true: v0=10 slowing to 0 over life 10 stops after travelling 50
- 5.6b interpolateVelocity=false/absent: finalVelocity is ignored (constant initialVelocity)
- 5.6b interpolateVelocity=true with no finalVelocity: constant velocity, reported as ignored
- 5.6b interpolateVelocity + rotateWithVelocity: the heading turns as the velocity vector turns
- 5.6b interpolateVelocity=true with an unresolvable finalVelocity (VectorTo targetPos) skips the particle and names the reason
- 5.6b both velocity entries are partial in xml-support

## 5.6c

- 5.6c interpolateAngle=true: angle goes linearly from initialAngle to finalAngle over the lifetime
- 5.6c interpolateAngle=false/absent: finalAngle is ignored
- 5.6c interpolateAngle keeps the constant rotation rate on top, and rotateWithVelocity still adds the heading
- 5.6c interpolateAngle=true with no usable finalAngle: angle unchanged and reported
- 5.6c a Random-valued finalAngle (shape from CloakofChaos: min 0, max 360) resolves per particle and differs between particles
- 5.6c both angle entries are partial in xml-support

## 5.6d

- 5.6d initalRGB (sic) tints the particle: 0..1 floats become 0..255
- 5.6d initialRGB (correct spelling) is accepted too, and spaces in the list are fine
- 5.6d white initalRGB (1,1,1) is no tint at all
- 5.6d interpolateRGB=true: colour goes linearly initial -> final over the lifetime
- 5.6d interpolateRGB=false/absent: finalRGB is ignored
- 5.6d out-of-range components clamp to 0..255
- 5.6d an unresolvable initalRGB (Select by variantId) is ignored and reported, not zeroed to black
- 5.6d the tint reaches the final draw call as 0..255 and RGB entries are partial

## 5.7a

- 5.7a randomSpriteFrame + inSpecificOrder=true: frames cycle 0,1,2,0,1,2... in emission order
- 5.7a randomSpriteFrame + inSpecificOrder=false: frames are pseudo-random (not the cycle) but always valid and repeatable
- 5.7a randomSpriteFrame with inSpecificOrder absent behaves as random (previous behaviour)
- 5.7a inSpecificOrder without randomSpriteFrame does not change the frame
- 5.7a inSpecificOrder / randomSpriteFrame are partial in xml-support

## 5.7b

- 5.7b particleIndexSpriteFrame=true: the frame is the particle's emission index, wrapping at the frame count
- 5.7b particleIndexSpriteFrame outranks randomSpriteFrame (even with inSpecificOrder=false)
- 5.7b particleIndexSpriteFrame=false/absent leaves the frame choice alone
- 5.7b particleIndexSpriteFrame counts particles within one emission (particlesPerEmission=3 -> 0,1,2 inside one burst)

## 5.7c

- 5.7c alternateSpriteFrameWithPunch=true: frame parity follows the punch count at birth (0 -> frame 0, 1 -> 1, 2 -> 0)
- 5.7c particles keep the frame they were born with when later punches happen
- 5.7c the item counts each distinct punch event once, however many frames it stays in motion.events
- 5.7c scrubbing time backwards resets the punch counter with the runs
- 5.7c alternateSpriteFrameWithPunch=false/absent leaves frames alone; entry is partial

## 5.8

- 5.8 randomizeInterval=true: gaps between emissions are NOT constant and stay inside [intervalMin, intervalMax]
- 5.8 randomizeInterval=true is deterministic: replaying the same run gives the same births
- 5.8 randomizeInterval=false/absent: the fixed emissionInterval is used and intervalMin/Max are ignored
- 5.8 randomizeInterval: the mean gap is near the midpoint of the range (uniform draw)
- 5.8 randomizeInterval=true without intervalMin/Max falls back to the fixed interval and is reported
- 5.8 randomizeInterval: a different run (later start) draws a different sequence from its own seed

## 5.9a

- 5.9a velocityRelativeToPlayerSpeed=true: the particle's velocity includes the player's (90 px/s * 2 s = 180 px along the walk)
- 5.9a velocityRelativeToPlayerSpeed=true, facing=-1 walking left: piece-space x is +180 so the rig mirror makes it -180 in the world
- 5.9a velocityRelativeToPlayerSpeed=false/absent: the player's speed is not added
- 5.9a the speed used is the one at SPAWN: speeding up afterwards does not change a live particle's path

## 5.9b

- 5.9b angleRelativeToPlayerSpeed=true: heading of the player's velocity (walking right = 0, down = +90) is added to the angle
- 5.9b angleRelativeToPlayerSpeed=true while facing left walking left: piece-space heading is 0 (rig mirror then points it left)
- 5.9b angleRelativeToPlayerSpeed=true with a still player adds nothing (no NaN)
- 5.9b angleRelativeToPlayerSpeed=false/absent leaves the angle alone; entry is partial

## guard

- guard: initialAngle with source="boomerangAngle" (CarrotBoomerang shape) gives angle 0, finite matrices, and a report
- guard: a Curve-valued initialRotationRate gives rate 0 (no NaN) and a report
- guard: sweep of all 256 particle scripts (walk, punches, facing flip, 6 s) draws no non-finite x, y, r or tint
