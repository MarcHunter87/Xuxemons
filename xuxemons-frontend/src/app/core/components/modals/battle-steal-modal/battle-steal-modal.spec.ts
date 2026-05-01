import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleStealModal } from './battle-steal-modal';

describe('BattleStealModal', () => {
  let component: BattleStealModal;
  let fixture: ComponentFixture<BattleStealModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleStealModal],
    }).compileComponents();

    fixture = TestBed.createComponent(BattleStealModal);
    component = fixture.componentInstance;
    component.vm = {
      stealOptions: () => [],
      confirmPrizeSelection: jasmine.createSpy('confirmPrizeSelection'),
      skipPrizeSelection: jasmine.createSpy('skipPrizeSelection'),
      isSubmittingBattleResult: () => false,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
