import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FriendRequestCard } from './friend-request-card';

describe('FriendRequestCard', () => {
  let component: FriendRequestCard;
  let fixture: ComponentFixture<FriendRequestCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendRequestCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FriendRequestCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
