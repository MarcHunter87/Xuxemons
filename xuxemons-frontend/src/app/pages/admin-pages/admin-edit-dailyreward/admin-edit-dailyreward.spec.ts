import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDailyrewardEdit } from './admin-edit-dailyreward';

describe('AdminDailyrewardEdit', () => {
  let component: AdminDailyrewardEdit;
  let fixture: ComponentFixture<AdminDailyrewardEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDailyrewardEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDailyrewardEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
