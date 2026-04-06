import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FriendRequestNotiModal } from './friend-request-noti-modal';

describe('FriendRequestNotiModal', () => {
  let component: FriendRequestNotiModal;
  let fixture: ComponentFixture<FriendRequestNotiModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendRequestNotiModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FriendRequestNotiModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
