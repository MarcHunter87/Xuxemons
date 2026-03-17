import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminGiveItem } from './admin-give-item';

describe('AdminGiveItem', () => {
  let component: AdminGiveItem;
  let fixture: ComponentFixture<AdminGiveItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminGiveItem]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminGiveItem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
