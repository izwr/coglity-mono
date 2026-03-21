import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import type { Tag } from "@coglity/shared";
import { testCaseService, type TestCaseWithTags } from "../services/testCaseService";
import { testSuiteService, type TestSuiteWithTags } from "../services/testSuiteService";
import { tagService } from "../services/tagService";

const createTestCaseSchema = yup.object({
  title: yup.string().required("Title is required").max(255),
  testSuiteId: yup.string().required("Test suite is required"),
});

type CreateFormValues = yup.InferType<typeof createTestCaseSchema>;

export function TestCases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<TestCaseWithTags[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allSuites, setAllSuites] = useState<TestSuiteWithTags[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateFormValues>({
    resolver: yupResolver(createTestCaseSchema),
    mode: "onChange",
    defaultValues: { title: "", testSuiteId: "" },
  });

  const fetchCases = async () => {
    try {
      const data = await testCaseService.getAll();
      setCases(Array.isArray(data) ? data : []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await tagService.getAll();
      setAllTags(Array.isArray(data) ? data : []);
    } catch {
      setAllTags([]);
    }
  };

  const fetchSuites = async () => {
    try {
      const data = await testSuiteService.getAll();
      setAllSuites(Array.isArray(data) ? data : []);
    } catch {
      setAllSuites([]);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchTags();
    fetchSuites();
  }, []);

  const closeForm = () => {
    reset({ title: "", testSuiteId: "" });
    setSelectedTagIds([]);
    setShowForm(false);
  };

  const onSubmit = async (data: CreateFormValues) => {
    const created = await testCaseService.create({
      title: data.title,
      testSuiteId: data.testSuiteId,
      testSteps: "",
      data: "",
      expectedResults: "",
      tagIds: selectedTagIds,
    });
    closeForm();
    navigate(`/test-cases/${created.id}`);
  };

  const handleDelete = async (id: string) => {
    await testCaseService.remove(id);
    setDeleteConfirmId(null);
    fetchCases();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId],
    );
  };

  return (
    <div className="page-test-suites">
      <div className="page-header">
        <h1>Test Cases</h1>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Test Case
          </button>
        )}
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">Create Test Case</div>
          <div className="ts-form-field">
            <label htmlFor="tc-title">Title</label>
            <input
              id="tc-title"
              type="text"
              placeholder="Enter test case title"
              autoFocus
              {...register("title")}
            />
            {errors.title && <span className="ts-form-error">{errors.title.message}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="tc-suite">Test Suite</label>
            {allSuites.length === 0 ? (
              <p className="ts-form-hint">No test suites available. Create a test suite first.</p>
            ) : (
              <select id="tc-suite" {...register("testSuiteId")}>
                <option value="">Select a test suite</option>
                {allSuites.map((suite) => (
                  <option key={suite.id} value={suite.id}>{suite.name}</option>
                ))}
              </select>
            )}
            {errors.testSuiteId && <span className="ts-form-error">{errors.testSuiteId.message}</span>}
          </div>
          <div className="ts-form-field">
            <label>Tags</label>
            {allTags.length === 0 ? (
              <p className="ts-form-hint">No tags available. Create tags first.</p>
            ) : (
              <div className="tag-picker">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-chip${selectedTagIds.includes(tag.id) ? " selected" : ""}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ts-form-actions">
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || isSubmitting}>
              Create
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="ts-empty">Loading...</p>
      ) : cases.length === 0 && !showForm ? (
        <div className="ts-empty-state">
          <div className="ts-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p>No test cases yet</p>
          <span>Create your first test case to get started</span>
        </div>
      ) : (
        <div className="ts-list">
          {cases.map((tc) => (
            <div
              key={tc.id}
              className="ts-card"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/test-cases/${tc.id}`)}
            >
              <div className="ts-card-body">
                <div className="ts-card-name">{tc.title}</div>
                <div className="ts-card-desc">{tc.testSuiteName}</div>
                {tc.tags.length > 0 && (
                  <div className="ts-card-tags">
                    {tc.tags.map((tag) => (
                      <span key={tag.id} className="tag-badge">{tag.name}</span>
                    ))}
                  </div>
                )}
                <div className="ts-card-meta">
                  Created {new Date(tc.createdAt).toLocaleDateString()}
                  {tc.createdByName && ` by ${tc.createdByName}`}
                  {tc.updatedByName && tc.updatedBy !== tc.createdBy && (
                    <> · Updated {new Date(tc.updatedAt).toLocaleDateString()} by {tc.updatedByName}</>
                  )}
                </div>
              </div>
              <div className="ts-card-actions" onClick={(e) => e.stopPropagation()}>
                {deleteConfirmId === tc.id ? (
                  <div className="ts-delete-confirm">
                    <button
                      className="btn btn-danger-sm"
                      onClick={() => handleDelete(tc.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn btn-ghost-sm"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-danger"
                    title="Delete"
                    onClick={() => setDeleteConfirmId(tc.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}