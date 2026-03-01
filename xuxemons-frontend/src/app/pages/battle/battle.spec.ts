import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Battle } from './battle';

describe('Battle', () => {
  let component: Battle;
  let fixture: ComponentFixture<Battle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Battle]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Battle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
