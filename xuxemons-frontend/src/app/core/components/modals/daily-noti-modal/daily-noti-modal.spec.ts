import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyNotiModal } from './daily-noti-modal';

describe('DailyNotiModal', () => {
  let component: DailyNotiModal;
  let fixture: ComponentFixture<DailyNotiModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyNotiModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailyNotiModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
