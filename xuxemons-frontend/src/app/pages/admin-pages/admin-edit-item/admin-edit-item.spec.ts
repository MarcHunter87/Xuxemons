import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminEditItem } from './admin-edit-item';

describe('AdminEditItem', () => {
  let component: AdminEditItem;
  let fixture: ComponentFixture<AdminEditItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEditItem]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEditItem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
