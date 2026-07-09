import { describe, expect, it } from 'vitest';
import { GAME_REGISTRY, getGame } from '../../index';
import { colorPitArenaDefinition } from '../color-pit-arena.definition';
describe('colorPitArenaDefinition',()=>{
 it('registers Color Pit Arena as a shell-controlled score game',()=>{expect(colorPitArenaDefinition).toMatchObject({id:'color-pit-arena',kind:'game',name:'Color Pit Arena',capabilities:{score:true,reset:true,tutorial:true,aiAutoplay:true,settings:true}});expect(colorPitArenaDefinition.capabilities.qualityModes??[]).toEqual([]);expect(colorPitArenaDefinition.capabilities.engineConfigurations??[]).toEqual([]);expect(colorPitArenaDefinition.tutorialPages?.map(page=>page.title)).toEqual(['Start','Play','Overflow','Restart']);expect(colorPitArenaDefinition.settingsFields?.every(field=>Boolean(field.section))).toBe(true);expect(colorPitArenaDefinition.aiFactory).toBeDefined()});
 it('is discoverable from the games registry and lookup helper',()=>{expect(GAME_REGISTRY.some(entry=>entry.id==='color-pit-arena')).toBe(true);expect(getGame('color-pit-arena')).toBe(colorPitArenaDefinition)});
});
