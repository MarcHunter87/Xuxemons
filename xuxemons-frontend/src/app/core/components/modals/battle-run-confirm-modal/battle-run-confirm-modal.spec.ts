import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleRunConfirmModal } from './battle-run-confirm-modal';

describe('BattleRunConfirmModal', () => {
  let component: BattleRunConfirmModal;
  let fixture: ComponentFixture<BattleRunConfirmModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleRunConfirmModal],
    }).compileComponents();

    fixture = TestBed.createComponent(BattleRunConfirmModal);
    component = fixture.componentInstance;
    component.vm = {
      cancelRunAway: jasmine.createSpy('cancelRunAway'),
      confirmRunAway: jasmine.createSpy('confirmRunAway'),
      isSubmittingRun: () => false,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
