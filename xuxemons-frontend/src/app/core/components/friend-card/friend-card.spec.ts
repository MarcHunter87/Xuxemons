import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FriendCard } from './friend-card';

describe('FriendCard', () => {
  let component: FriendCard;
  let fixture: ComponentFixture<FriendCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FriendCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
