import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleVictoryModal } from './battle-victory-modal';

describe('BattleVictoryModal', () => {
  let component: BattleVictoryModal;
  let fixture: ComponentFixture<BattleVictoryModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleVictoryModal],
    }).compileComponents();

    fixture = TestBed.createComponent(BattleVictoryModal);
    component = fixture.componentInstance;
    component.vm = {
      selectedXuxemon: () => null,
      stolenXuxemon: () => null,
      closeVictoryModal: jasmine.createSpy('closeVictoryModal'),
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
