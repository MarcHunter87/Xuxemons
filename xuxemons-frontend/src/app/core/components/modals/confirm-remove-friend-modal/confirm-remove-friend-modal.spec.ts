import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmRemoveFriendModal } from './confirm-remove-friend-modal';

describe('ConfirmRemoveFriendModal', () => {
  let component: ConfirmRemoveFriendModal;
  let fixture: ComponentFixture<ConfirmRemoveFriendModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmRemoveFriendModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmRemoveFriendModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
