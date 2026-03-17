import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminEditXuxemon } from './admin-edit-xuxemon';

describe('AdminEditXuxemon', () => {
  let component: AdminEditXuxemon;
  let fixture: ComponentFixture<AdminEditXuxemon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEditXuxemon]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEditXuxemon);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
