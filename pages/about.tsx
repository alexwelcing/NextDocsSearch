import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import CircleNav from '@/components/ui/CircleNav';
import PDFLinks from '@/components/PDFLinks';
import StructuredData from '@/components/StructuredData';
import styles from '@/styles/About.module.css';

const About: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/getPDFs')
      .then((res) => res.json())
      .then((data) => setPdfFiles(data.pdfFiles));
  }, []);

  return (
    <div className={styles.pageWrapper}>
      <Head>
        <title>Alex Welcing | Technical Product Manager</title>
        <meta
          name="description"
          content="Results-driven product leader with expertise in AI, analytics, and platform technologies. 10+ years building SaaS products for legal, healthcare, and technology sectors."
        />
        <meta name="keywords" content="Alex Welcing, Technical Product Manager, AI, SaaS, Product Leader, New York" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com/about" />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Alex Welcing | Technical Product Manager" />
        <meta property="og:description" content="Results-driven product leader building platform technologies for SaaS, information and professional services." />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com/about" />
        <meta property="og:type" content="profile" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing | Technical Product Manager" />
        <meta name="twitter:description" content="Results-driven product leader building platform technologies for SaaS, information and professional services." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />
      </Head>

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          jobTitle: "Technical Product Manager",
          url: "https://alexwelcing.com",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ],
          description: "Results-driven product leader with expertise in AI, analytics, and platform technologies for SaaS and professional services.",
          knowsAbout: [
            "Product Management",
            "AI & Machine Learning",
            "SaaS Platforms",
            "System Architecture",
            "API Design"
          ]
        }}
      />

      <header className={styles.header}>
        <CircleNav />
      </header>

      <main className={styles.mainContent}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.name}>Alex Welcing</h1>
            <p className={styles.title}>Technical Product Manager</p>
            <p className={styles.location}>
              <span className="material-icons-outlined">location_on</span>
              New York, NY
            </p>
          </div>

          <div className={styles.contactBar}>
            <a href="mailto:AlexWelcing@gmail.com" className={styles.contactLink}>
              <span className="material-icons-outlined">email</span>
              AlexWelcing@gmail.com
            </a>
            <a href="tel:817-734-5375" className={styles.contactLink}>
              <span className="material-icons-outlined">phone</span>
              817-734-5375
            </a>
            <a href="https://linkedin.com/in/alexwelcing" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              <span className="material-icons-outlined">person</span>
              LinkedIn
            </a>
            <a href="https://www.alexwelcing.com" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              <span className="material-icons-outlined">language</span>
              alexwelcing.com
            </a>
          </div>
        </section>

        {/* Summary Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Summary</h2>
          <p className={styles.summaryText}>
            Results-driven product leader with a strong track record of success in building and growing platform technologies for SaaS, information and professional services. Specialized experience in AI, analytics, development, and marketing, including user management and monetization platforms. An innovative thinker with a strong background in technical product management, adept at setting long-term vision, driving product requirements, generating insights, and executing strategies aligned with customer needs. Demonstrated proficiency in technical decisions, relational databases, problem-solving, and cross-functional collaboration.
          </p>
        </section>

        {/* Experience Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experience</h2>

          {/* Law Business Research */}
          <article className={styles.experienceCard}>
            <div className={styles.experienceHeader}>
              <div className={styles.experienceTitle}>
                <h3>Technical Product Manager</h3>
                <p className={styles.company}>Law Business Research</p>
              </div>
              <div className={styles.experienceMeta}>
                <span className={styles.dates}>January 2024 - Present</span>
                <span className={styles.experienceLocation}>New York, NY</span>
              </div>
            </div>
            <p className={styles.companyDescription}>
              Technology-enabled information services business powering the global legal industry with intelligence and analytics.
            </p>
            <ul className={styles.achievementList}>
              <li>Replaced a legacy entitlement and key system servicing billions of monthly requests and underpinning all client subscriptions — restoring reliability, unlocking revenue growth, and unifying product access across the platform.</li>
              <li>Managed client identity and subscription platform connecting multiple legal and analytics products, configuring SSO for more than 50% of the AmLaw 200.</li>
              <li>Launched monorepo approach for AI API execution hub — a secure workspace with type safety, live introspection, and self-improving model usage accuracy across 3 separate APIs for internal use.</li>
              <li>Rebuilt the client settings and analytics applications from the ground up, improving usability and cutting configuration time by 60%.</li>
              <li>Blended strategy and engineering execution, acting as a &ldquo;hands-on architect PM&rdquo; trusted to prototype, ship, and scale products that balance rigor, creativity, and measurable business impact.</li>
              <li>Formulated and prioritized ambitious product initiatives by synthesizing feedback from legal, commercial, and engineering leaders, enabling the launch and scale of high-impact subscription workflows.</li>
            </ul>
          </article>

          {/* Obsess VR */}
          <article className={styles.experienceCard}>
            <div className={styles.experienceHeader}>
              <div className={styles.experienceTitle}>
                <h3>Product Manager</h3>
                <p className={styles.company}>Obsess VR</p>
              </div>
              <div className={styles.experienceMeta}>
                <span className={styles.dates}>April 2022 - May 2023</span>
                <span className={styles.experienceLocation}>New York, NY</span>
              </div>
            </div>
            <p className={styles.companyDescription}>
              3D virtual store platform enabling brands to build immersive, engaging shopping experiences on their e-commerce sites.
            </p>
            <ul className={styles.achievementList}>
              <li>Drove long-term strategic planning efforts and enhanced consumer product experience by demonstrating exceptional leadership.</li>
              <li>Set long-term strategy for SaaS platform technologies and VR capabilities, aligning with stakeholders.</li>
              <li>Spearheaded product requirements definition, planning, design, and testing for new features.</li>
              <li>Utilized insights from data, industry trends, and customer feedback to prioritize product features.</li>
              <li>Acted as a liaison between marketing, sales, development, and CX to manage the product lifecycle.</li>
              <li>Collaborated with development to execute fixes for critical bugs impacting product performance.</li>
            </ul>
          </article>

          {/* Manatt Developer */}
          <article className={styles.experienceCard}>
            <div className={styles.experienceHeader}>
              <div className={styles.experienceTitle}>
                <h3>Developer</h3>
                <p className={styles.company}>Manatt, Phelps, & Phillips</p>
              </div>
              <div className={styles.experienceMeta}>
                <span className={styles.dates}>January 2019 - April 2022</span>
                <span className={styles.experienceLocation}>New York, NY</span>
              </div>
            </div>
            <p className={styles.companyDescription}>
              Law and consulting firm providing legal and consulting services to clients.
            </p>
            <ul className={styles.achievementList}>
              <li>Guided a cross-functional team in providing secure access to legal and regulatory analysis through an exclusive SaaS platform.</li>
              <li>Generated in-depth data analysis content for executive leadership within the healthcare sector.</li>
              <li>Devised AI-based document scanning and image selection for publication, streamlining consultant tasks, enhancing product knowledge graph precision, and eliminating potential human errors.</li>
              <li>Built and maintained firm-wide knowledge and training portal, delivering extraordinary ROI with minimal operating and development costs.</li>
              <li>Equipped strategic leaders with comprehensive data analysis content tailored for executive leadership, enabling well-informed decisions and a competitive edge.</li>
            </ul>
          </article>

          {/* Manatt Consultant */}
          <article className={styles.experienceCard}>
            <div className={styles.experienceHeader}>
              <div className={styles.experienceTitle}>
                <h3>Consultant</h3>
                <p className={styles.company}>Manatt Phelps & Phillips</p>
              </div>
              <div className={styles.experienceMeta}>
                <span className={styles.dates}>August 2017 - January 2019</span>
                <span className={styles.experienceLocation}>New York, NY</span>
              </div>
            </div>
            <ul className={styles.achievementList}>
              <li>Conducted comprehensive data analysis to provide internal executives with insights into product utilization for top 1000 clients.</li>
              <li>Spearheaded end-to-end publication data reporting, security, and service monitoring, resulting in enhanced data connector performance.</li>
              <li>Conceptualized and introduced an exclusive client-centric publishing SaaS platform, orchestrating app evolution from beta product to generating millions in annual recurring revenue.</li>
              <li>Directed quarterly prioritization sessions using JIRA and Asana with cross-functional teams, optimizing backlog refinement for 18 client projects and increasing on-time feature delivery by 27% over 12 months.</li>
            </ul>
          </article>

          {/* Arkadium */}
          <article className={styles.experienceCard}>
            <div className={styles.experienceHeader}>
              <div className={styles.experienceTitle}>
                <h3>Partner Development</h3>
                <p className={styles.company}>Arkadium</p>
              </div>
              <div className={styles.experienceMeta}>
                <span className={styles.dates}>July 2016 - August 2017</span>
                <span className={styles.experienceLocation}>New York, NY</span>
              </div>
            </div>
            <ul className={styles.achievementList}>
              <li>Introduced NLP-driven interactive advertising content solution specifically designed for publishers by leveraging expertise in new business development.</li>
              <li>Pioneered the development of groundbreaking AI partnerships by leveraging NLP contextual understanding to create interactive content.</li>
              <li>Directed discovery sessions with 15+ prospective partners over 6 months, utilizing campaigns in CRM to increase qualified partner pipeline by 40%.</li>
              <li>Spearheaded the integration of AI technologies into partner co-development initiatives over a 6-month period, resulting in 25% faster solution go-to-market.</li>
            </ul>
          </article>
        </section>

        {/* Skills Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skills</h2>

          <div className={styles.skillsGrid}>
            <div className={styles.skillCategory}>
              <h3 className={styles.skillCategoryTitle}>
                <span className="material-icons-outlined">dashboard</span>
                Product Management & Development
              </h3>
              <div className={styles.skillTags}>
                <span className={styles.skillTag}>Product Management</span>
                <span className={styles.skillTag}>Product Vision</span>
                <span className={styles.skillTag}>Scenario Planning</span>
                <span className={styles.skillTag}>Simulation Modeling</span>
              </div>
            </div>

            <div className={styles.skillCategory}>
              <h3 className={styles.skillCategoryTitle}>
                <span className="material-icons-outlined">analytics</span>
                Data Analytics & User Insights
              </h3>
              <div className={styles.skillTags}>
                <span className={styles.skillTag}>Development</span>
                <span className={styles.skillTag}>Software Design</span>
                <span className={styles.skillTag}>API Design</span>
                <span className={styles.skillTag}>API Management</span>
                <span className={styles.skillTag}>Nginx Plus</span>
              </div>
            </div>

            <div className={styles.skillCategory}>
              <h3 className={styles.skillCategoryTitle}>
                <span className="material-icons-outlined">psychology</span>
                AI & Machine Learning
              </h3>
              <div className={styles.skillTags}>
                <span className={styles.skillTag}>System Design</span>
                <span className={styles.skillTag}>Access Control</span>
                <span className={styles.skillTag}>SSO</span>
                <span className={styles.skillTag}>Full-stack Development</span>
                <span className={styles.skillTag}>Solution Architecture</span>
                <span className={styles.skillTag}>Enterprise Architecture</span>
                <span className={styles.skillTag}>AI</span>
              </div>
            </div>
          </div>
        </section>

        {/* Education Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Education</h2>
          <article className={styles.educationCard}>
            <h3>Bachelor of Science in Marketing</h3>
            <p className={styles.school}>University of Texas, Dallas</p>
            <p className={styles.schoolDetail}>Naveen Jindal School of Management</p>
          </article>
        </section>

        {/* Resume Downloads */}
        {pdfFiles.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Download Resume</h2>
            <div className={styles.resumeGrid}>
              <PDFLinks files={pdfFiles} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default About;
