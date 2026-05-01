import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleRunawayResultModal } from './battle-runaway-result-modal';

describe('BattleRunawayResultModal', () => {
  let component: BattleRunawayResultModal;
  let fixture: ComponentFixture<BattleRunawayResultModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleRunawayResultModal],
    }).compileComponents();

    fixture = TestBed.createComponent(BattleRunawayResultModal);
    component = fixture.componentInstance;
    component.vm = {
      runawayResultMessage: () => '',
      closeRunawayResultModal: jasmine.createSpy('closeRunawayResultModal'),
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
