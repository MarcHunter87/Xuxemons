import { ComponentFixture, TestBed } from '@angular/core/testing';

import { XuxemonCard } from './xuxemon-card';

describe('XuxemonCard', () => {
  let component: XuxemonCard;
  let fixture: ComponentFixture<XuxemonCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [XuxemonCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(XuxemonCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
