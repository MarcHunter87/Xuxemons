import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyxuxemonCard } from './myxuxemon-card';

describe('MyxuxemonCard', () => {
  let component: MyxuxemonCard;
  let fixture: ComponentFixture<MyxuxemonCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyxuxemonCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyxuxemonCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
