import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteAccountModal } from './delete-account-modal';

describe('DeleteAccountModal', () => {
  let component: DeleteAccountModal;
  let fixture: ComponentFixture<DeleteAccountModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteAccountModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteAccountModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
