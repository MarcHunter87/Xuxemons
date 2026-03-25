import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDailyreward } from './admin-dailyreward';

describe('AdminDailyreward', () => {
  let component: AdminDailyreward;
  let fixture: ComponentFixture<AdminDailyreward>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDailyreward]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDailyreward);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
