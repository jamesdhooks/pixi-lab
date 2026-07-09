import { describe, expect, it } from 'vitest';
import { createColorPitModel } from '../ColorPitModel';
function drainRound(model: ReturnType<typeof createColorPitModel>) { for (let i=0;i<800;i+=1){ const state=model.getState(); if(state.phase==='result') return state; if(state.remaining>0&&state.activeBalls.length<3) model.spawnBall(0.5); model.step(1/30); } return model.getState(); }
describe('ColorPitModel',()=>{
 it('creates deterministic lanes and initial state from seed',()=>{const a=createColorPitModel({seed:7,width:800,height:600});const b=createColorPitModel({seed:7,width:800,height:600});expect(a.getState().lanes).toEqual(b.getState().lanes);expect(a.getState()).toMatchObject({phase:'start',score:0,overflow:0,remaining:36})});
 it('first spawn transitions start to play and consumes round budget',()=>{const model=createColorPitModel({seed:2,width:800,height:600,roundBalls:12});const ball=model.spawnBall(0.25);const state=model.getState();expect(ball.x).toBeGreaterThanOrEqual(state.board.left+ball.radius);expect(state.phase).toBe('play');expect(state.spawned).toBe(1);expect(state.remaining).toBe(11)});
 it('scores matched lanes and increments streak',()=>{const model=createColorPitModel({seed:3,width:800,height:600,roundBalls:12});const ball=model.spawnBall(0.5);const state=model.getState();const target=state.lanes.find(lane=>lane.id===ball.targetLaneId)!;model.nudgeToward(ball.id,(target.x+target.width/2)/state.width);for(let i=0;i<180&&model.getState().activeBalls.length>0;i+=1)model.step(1/30);expect(model.getState().score).toBeGreaterThan(0);expect(model.getState().streak).toBeGreaterThan(0)});
 it('tracks overflow on mismatches and can bust',()=>{const model=createColorPitModel({seed:4,width:800,height:600,roundBalls:12,overflowLimit:3});for(let drop=0;drop<12&&model.getState().phase!=='result';drop+=1){const probe=model.spawnBall(0.5);const state=model.getState();const wrongLane=state.lanes.find(lane=>lane.id!==probe.targetLaneId)!;const wrongCenter=(wrongLane.x+wrongLane.width/2)/state.width;model.nudgeToward(probe.id,wrongCenter);for(let i=0;i<220&&model.getState().activeBalls.length>0;i+=1){model.nudgeToward(probe.id,wrongCenter);model.step(1/30)}}expect(model.getState().phase).toBe('result');expect(model.getState().result?.outcome).toBe('bust');expect(model.getState().overflow).toBeGreaterThanOrEqual(3)});
 it('does not complete after the first ball drains when round budget remains', () => {
   const model = createColorPitModel({ seed: 8, width: 800, height: 600, roundBalls: 1, overflowLimit: 99 });
   model.spawnBall(0.5);
   for (let i = 0; i < 180 && model.getState().activeBalls.length > 0; i += 1) model.step(1 / 30);
   expect(model.getState().spawned).toBe(1);
   expect(model.getState().remaining).toBe(11);
   expect(model.getState().phase).toBe('play');
 });

 it('completes when all balls are spawned and drained, then restart clears state',()=>{const model=createColorPitModel({seed:5,width:800,height:600,roundBalls:12,overflowLimit:99});const result=drainRound(model);expect(result.phase).toBe('result');expect(result.spawned).toBe(12);model.restart();expect(model.getState()).toMatchObject({phase:'start',score:0,overflow:0,spawned:0,remaining:12})});
});
