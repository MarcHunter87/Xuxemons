import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleFooter } from './battle-footer';

describe('BattleFooter', () => {
  let component: BattleFooter;
  let fixture: ComponentFixture<BattleFooter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleFooter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BattleFooter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
