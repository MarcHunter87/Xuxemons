import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAwardModal } from './admin-award-modal';

describe('AdminAwardModal', () => {
  let component: AdminAwardModal;
  let fixture: ComponentFixture<AdminAwardModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAwardModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAwardModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
