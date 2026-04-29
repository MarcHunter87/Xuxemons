import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleTeam } from './battle-team';

describe('BattleTeam', () => {
  let component: BattleTeam;
  let fixture: ComponentFixture<BattleTeam>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleTeam]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BattleTeam);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
